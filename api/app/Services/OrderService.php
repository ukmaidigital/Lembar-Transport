<?php

namespace App\Services;

use App\Enums\ActorType;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\FerryRoute;
use App\Models\Location;
use App\Models\Order;
use App\Models\Rating;
use App\Models\User;
use App\Models\VehicleClass;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Order creation from a locked quote, ferry coupling, idempotency, docking anchor and ratings. */
class OrderService
{
    public function __construct(
        private QuoteService $quotes,
        private PaymentService $payments,
        private NotificationService $notifications,
        private OrderStateMachine $stateMachine,
    ) {}

    /**
     * @param  array{quote_token:string, vehicle_class:string, ferry?:array{route_id?:int, departure_at?:string, arrival_date?:string}, meeting_point_id?:int, contact:array{name:string, phone:string, email?:string, locale?:string}, payment_method:string, notes?:string, channel?:string, price_override?:int, override_reason?:string}  $data
     */
    public function create(array $data, ?User $customer = null, ?string $idempotencyKey = null, ?User $createdBy = null): Order
    {
        if ($idempotencyKey) {
            $existing = Order::query()->where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                return $existing;
            }
        }
        $resolved = $this->quotes->resolve($data['quote_token'], $data['vehicle_class']);
        $input = $resolved['input'];
        $option = $resolved['option'];
        if (! $option['fits'] && empty($data['force_capacity'])) {
            throw new BusinessRuleException('CAPACITY_EXCEEDED', implode('; ', $option['reasons']), 422, ['field' => 'passengers', 'reasons' => $option['reasons']]);
        }
        $class = VehicleClass::findOrFail($option['vehicle_class_id']);
        $origin = Location::query()->where('is_origin', true)->firstOrFail();
        $meetingPoint = ! empty($data['meeting_point_id'])
            ? Location::query()->where('type', 'meeting_point')->findOrFail($data['meeting_point_id'])
            : Location::query()->where('type', 'meeting_point')->orderBy('sort_order')->first();
        $destination = $input['destination_location_id'] ? Location::find($input['destination_location_id']) : null;

        $pickupAt = Carbon::parse($input['pickup_at']);
        $ferry = $data['ferry'] ?? null;
        $ferryRoute = null;
        $etaMin = $etaMax = $departure = null;
        if ($ferry && ! empty($ferry['route_id'])) {
            $ferryRoute = FerryRoute::findOrFail($ferry['route_id']);
            if (! empty($ferry['departure_at'])) {
                $departure = Carbon::parse($ferry['departure_at'])->utc();
                $etaMin = $departure->copy()->addMinutes($ferryRoute->crossing_min_min);
                $etaMax = $departure->copy()->addMinutes($ferryRoute->crossing_min_max);
                $pickupAt = $etaMin->copy();
            }
        }
        $breakdown = $option['price_breakdown'];
        $total = (int) $breakdown['total'];
        if (isset($data['price_override']) && $createdBy) {
            if (empty($data['override_reason'])) {
                throw new BusinessRuleException('OVERRIDE_REASON_REQUIRED', 'Override harga memerlukan alasan.', 422);
            }
            $total = (int) $data['price_override'];
            $breakdown['override'] = ['total' => $total, 'reason' => $data['override_reason'], 'by' => $createdBy->id];
            $breakdown['total'] = $total;
        }
        $rate = (float) $option['commission_rate'];
        $commission = (int) round($total * $rate);
        $method = PaymentMethod::from($data['payment_method']);
        $contact = $data['contact'];
        $phone = OtpService::normalizePhone($contact['phone']);
        $locale = $contact['locale'] ?? $customer?->locale ?? 'id';

        $order = DB::transaction(function () use ($data, $customer, $idempotencyKey, $createdBy, $input, $class, $origin, $meetingPoint, $destination, $pickupAt, $ferryRoute, $departure, $etaMin, $etaMax, $breakdown, $total, $rate, $commission, $method, $contact, $phone, $locale) {
            $order = Order::create([
                'code' => Order::generateCode(),
                'customer_id' => $customer?->id,
                'guest_name' => $contact['name'],
                'guest_phone' => $phone,
                'guest_email' => $contact['email'] ?? $customer?->email,
                'locale' => $locale,
                'channel' => $data['channel'] ?? ($createdBy ? 'admin' : 'web'),
                'service_type' => $input['service_type'],
                'status' => OrderStatus::PendingPayment,
                'payment_status' => PaymentStatus::Unpaid,
                'payment_method' => $method,
                'origin_location_id' => $origin->id,
                'meeting_point_id' => $meetingPoint?->id,
                'destination_location_id' => $destination?->id,
                'destination_text' => $data['destination_text'] ?? null,
                'zone_id' => $input['zone_id'],
                'vehicle_class_id' => $class->id,
                'pickup_at' => $pickupAt,
                'ferry_route_id' => $ferryRoute?->id,
                'ferry_departure_at' => $departure,
                'ferry_eta_min_at' => $etaMin ?? $pickupAt,
                'ferry_eta_max_at' => $etaMax ?? $pickupAt->copy()->addMinutes(60),
                'passengers' => $input['passengers'],
                'luggage_units' => $input['luggage_units'],
                'child_seats' => $input['child_seats'],
                'needs_roof_rack' => $input['needs_roof_rack'],
                'notes' => $data['notes'] ?? null,
                'price_breakdown' => $breakdown,
                'subtotal' => $breakdown['base'],
                'surcharge_total' => $breakdown['surcharge_total'] ?? 0,
                'discount_total' => 0,
                'total' => $total,
                'commission_rate' => $rate,
                'commission_amount' => $commission,
                'driver_payout_amount' => $total - $commission,
                'quote_token' => $data['quote_token'],
                'idempotency_key' => $idempotencyKey,
                'created_by' => $createdBy?->id,
            ]);

            return $this->payments->initialize($order);
        });

        $this->notifications->orderCreated($order);

        return $order->fresh(['destination', 'meetingPoint', 'vehicleClass', 'ferryRoute']);
    }

    /** Customer or Ops marks the ferry as docked: the free-waiting anchor. */
    public function markDocked(Order $order, ActorType $actor, ?Carbon $at = null, bool $override = false): Order
    {
        if (! in_array($order->status, [OrderStatus::Confirmed, OrderStatus::Dispatching, OrderStatus::Assigned, OrderStatus::EnRoute, OrderStatus::Arrived], true)) {
            throw new BusinessRuleException('DOCKED_NOT_ALLOWED', 'Status pesanan tidak memungkinkan konfirmasi sandar.', 409);
        }
        $windowOpen = $order->ferry_eta_min_at ? $order->ferry_eta_min_at->copy()->subHours(2) : $order->pickup_at->copy()->subHours(2);
        if ($actor === ActorType::Customer && now()->lt($windowOpen)) {
            throw new BusinessRuleException('DOCKED_TOO_EARLY', 'Tombol tersedia mulai 2 jam sebelum estimasi sandar.', 409);
        }
        if ($order->ferry_docked_at && ! $override) {
            return $order;
        }
        $order->ferry_docked_at = $at ?? now();
        $order->docked_source = $actor->value;
        $order->save();
        $this->notifications->docked($order);

        return $order;
    }

    public function rate(Order $order, int $score, ?string $comment, ?User $customer = null): Rating
    {
        if ($order->status !== OrderStatus::Completed || ! $order->driver_id) {
            throw new BusinessRuleException('RATING_NOT_ALLOWED', 'Rating hanya untuk pesanan yang selesai.', 409);
        }
        if ($order->completed_at && $order->completed_at->lt(now()->subDays(7))) {
            throw new BusinessRuleException('RATING_WINDOW_CLOSED', 'Masa pemberian rating (7 hari) sudah berakhir.', 409);
        }
        if ($order->rating) {
            throw new BusinessRuleException('ALREADY_RATED', 'Pesanan ini sudah diberi rating.', 409);
        }
        $rating = Rating::create(['order_id' => $order->id, 'driver_id' => $order->driver_id, 'customer_id' => $customer?->id ?? $order->customer_id, 'score' => $score, 'comment' => $comment]);
        $driver = $order->driver;
        $agg = Rating::query()->where('driver_id', $driver->id)->where('is_published', true)->where('created_at', '>=', now()->subDays(90));
        $driver->update(['rating_avg' => round((float) $agg->avg('score'), 2), 'rating_count' => Rating::where('driver_id', $driver->id)->count()]);

        return $rating;
    }

    /** Resolve an order for the public ticket page: code plus last 4 digits of the phone, or an owning customer. */
    public function findForTicket(string $code, ?string $phoneLast4, ?User $user): Order
    {
        $order = Order::query()->where('code', $code)->first();
        if (! $order) {
            throw new BusinessRuleException('ORDER_NOT_FOUND', 'Pesanan tidak ditemukan.', 404);
        }
        if ($user && ($user->isAdmin() || $order->customer_id === $user->id)) {
            return $order;
        }
        if ($phoneLast4 && substr(preg_replace('/\D/', '', $order->guest_phone), -4) === $phoneLast4) {
            return $order;
        }
        throw new BusinessRuleException('ORDER_FORBIDDEN', 'Masukkan 4 digit terakhir nomor telepon untuk membuka tiket.', 403);
    }

    public function stateMachine(): OrderStateMachine
    {
        return $this->stateMachine;
    }
}

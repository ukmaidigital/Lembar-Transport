<?php

namespace App\Enums;

enum OrderStatus: string
{
    case PendingPayment = 'pending_payment';
    case Confirmed = 'confirmed';
    case Dispatching = 'dispatching';
    case Assigned = 'assigned';
    case EnRoute = 'en_route';
    case Arrived = 'arrived';
    case OnTrip = 'on_trip';
    case Completed = 'completed';
    case NoShow = 'no_show';
    case Cancelled = 'cancelled';
    case Expired = 'expired';

    public function label(string $locale = 'id'): string
    {
        return match ($this) {
            self::PendingPayment => $locale === 'en' ? 'Awaiting payment' : 'Menunggu Pembayaran',
            self::Confirmed => $locale === 'en' ? 'Confirmed' : 'Terkonfirmasi',
            self::Dispatching => $locale === 'en' ? 'Finding a driver' : 'Mencari Driver',
            self::Assigned => $locale === 'en' ? 'Driver assigned' : 'Driver Ditugaskan',
            self::EnRoute => $locale === 'en' ? 'Driver heading to the port' : 'Driver Menuju Pelabuhan',
            self::Arrived => $locale === 'en' ? 'Driver at meeting point' : 'Driver Tiba di Titik Temu',
            self::OnTrip => $locale === 'en' ? 'On the way' : 'Dalam Perjalanan',
            self::Completed => $locale === 'en' ? 'Completed' : 'Selesai',
            self::NoShow => $locale === 'en' ? 'Passenger no-show' : 'Penumpang Tidak Hadir',
            self::Cancelled => $locale === 'en' ? 'Cancelled' : 'Dibatalkan',
            self::Expired => $locale === 'en' ? 'Expired' : 'Kedaluwarsa',
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Completed, self::NoShow, self::Cancelled, self::Expired], true);
    }

    public function isActiveTrip(): bool
    {
        return in_array($this, [self::Assigned, self::EnRoute, self::Arrived, self::OnTrip], true);
    }

    /** @return array<string, string[]> allowed transitions (Lampiran C) */
    public static function transitions(): array
    {
        return [
            self::PendingPayment->value => [self::Confirmed->value, self::Expired->value, self::Cancelled->value],
            self::Confirmed->value => [self::Dispatching->value, self::Cancelled->value],
            self::Dispatching->value => [self::Assigned->value, self::Cancelled->value],
            self::Assigned->value => [self::Dispatching->value, self::EnRoute->value, self::Cancelled->value],
            self::EnRoute->value => [self::Arrived->value, self::Dispatching->value, self::Cancelled->value],
            self::Arrived->value => [self::OnTrip->value, self::NoShow->value, self::Cancelled->value],
            self::OnTrip->value => [self::Completed->value],
            self::Completed->value => [],
            self::NoShow->value => [],
            self::Cancelled->value => [],
            self::Expired->value => [],
        ];
    }

    public function canTransitionTo(self $to): bool
    {
        return in_array($to->value, self::transitions()[$this->value], true);
    }
}

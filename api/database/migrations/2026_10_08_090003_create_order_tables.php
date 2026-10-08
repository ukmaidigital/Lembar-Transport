<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->foreignId('customer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('guest_name');
            $table->string('guest_phone', 32);
            $table->string('guest_email')->nullable();
            $table->string('locale', 5)->default('id');
            $table->string('channel', 10)->default('web');
            $table->string('service_type', 30)->default('transfer_oneway');
            $table->string('status', 30)->default('pending_payment');
            $table->string('payment_status', 30)->default('unpaid');
            $table->string('payment_method', 20);
            $table->boolean('needs_attention')->default(false);
            $table->foreignId('origin_location_id')->constrained('locations');
            $table->foreignId('meeting_point_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->foreignId('destination_location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->string('destination_text')->nullable();
            $table->decimal('destination_lat', 10, 7)->nullable();
            $table->decimal('destination_lng', 10, 7)->nullable();
            $table->foreignId('zone_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('vehicle_class_id')->constrained();
            $table->timestamp('pickup_at');
            $table->foreignId('ferry_route_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('ferry_departure_at')->nullable();
            $table->timestamp('ferry_eta_min_at')->nullable();
            $table->timestamp('ferry_eta_max_at')->nullable();
            $table->timestamp('ferry_docked_at')->nullable();
            $table->string('docked_source', 10)->nullable();
            $table->unsignedSmallInteger('passengers');
            $table->decimal('luggage_units', 4, 1)->default(0);
            $table->unsignedSmallInteger('child_seats')->default(0);
            $table->boolean('needs_roof_rack')->default(false);
            $table->text('notes')->nullable();
            $table->json('price_breakdown');
            $table->bigInteger('subtotal');
            $table->bigInteger('surcharge_total')->default(0);
            $table->bigInteger('discount_total')->default(0);
            $table->bigInteger('waiting_fee')->default(0);
            $table->bigInteger('total');
            $table->decimal('commission_rate', 5, 2);
            $table->bigInteger('commission_amount');
            $table->bigInteger('driver_payout_amount');
            $table->foreignId('driver_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('en_route_at')->nullable();
            $table->timestamp('arrived_at')->nullable();
            $table->timestamp('on_trip_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancelled_by_type', 10)->nullable();
            $table->string('cancellation_reason')->nullable();
            $table->bigInteger('cancellation_fee')->default(0);
            $table->unsignedSmallInteger('dispatch_wave')->default(0);
            $table->unsignedSmallInteger('dispatch_cycle')->default(1);
            $table->timestamp('dispatch_started_at')->nullable();
            $table->timestamp('dispatch_next_at')->nullable();
            $table->timestamp('payment_expires_at')->nullable();
            $table->bigInteger('cash_collected')->nullable();
            $table->string('cash_note')->nullable();
            $table->string('quote_token', 64)->nullable();
            $table->string('idempotency_key', 80)->nullable()->unique();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['status', 'pickup_at']);
            $table->index(['driver_id', 'pickup_at']);
            $table->index(['guest_phone', 'created_at']);
            $table->index(['needs_attention', 'status']);
        });

        Schema::create('order_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30);
            $table->string('actor_type', 10);
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('client_timestamp')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('dispatch_offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('wave');
            $table->unsignedSmallInteger('cycle')->default(1);
            $table->decimal('score', 6, 2)->default(0);
            $table->timestamp('offered_at');
            $table->timestamp('expires_at');
            $table->string('response', 15)->default('pending');
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();
            $table->index(['order_id', 'response']);
            $table->index(['driver_id', 'response', 'expires_at']);
        });

        Schema::create('ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedTinyInteger('score');
            $table->text('comment')->nullable();
            $table->boolean('is_published')->default(true);
            $table->foreignId('moderated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('trip_issues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30);
            $table->text('message')->nullable();
            $table->string('status', 20)->default('open');
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trip_issues');
        Schema::dropIfExists('ratings');
        Schema::dropIfExists('dispatch_offers');
        Schema::dropIfExists('order_status_histories');
        Schema::dropIfExists('orders');
    }
};

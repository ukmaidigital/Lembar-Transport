<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zones', function (Blueprint $table) {
            $table->id();
            $table->string('code', 10)->unique();
            $table->string('name');
            $table->string('description')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->json('polygon')->nullable();
            $table->timestamps();
        });

        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->string('type', 20);
            $table->string('name_id');
            $table->string('name_en')->nullable();
            $table->json('aliases')->nullable();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->decimal('distance_km_est', 6, 1)->nullable();
            $table->unsignedSmallInteger('duration_min_est')->nullable();
            $table->string('photo_path')->nullable();
            $table->text('instructions_id')->nullable();
            $table->text('instructions_en')->nullable();
            $table->boolean('is_origin')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['type', 'is_active']);
        });

        Schema::create('ferry_routes', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('operator');
            $table->string('origin_port');
            $table->unsignedSmallInteger('crossing_min_min');
            $table->unsignedSmallInteger('crossing_min_max');
            $table->string('schedule_timezone', 5)->default('WITA');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('tariffs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_class_id')->constrained()->cascadeOnDelete();
            $table->string('service_type', 30)->default('transfer_oneway');
            $table->bigInteger('base_price');
            $table->timestamp('valid_from');
            $table->timestamp('valid_to')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['zone_id', 'vehicle_class_id', 'service_type', 'valid_from'], 'tariffs_unique_rule');
        });

        Schema::create('surcharges', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->index();
            $table->string('name_id');
            $table->string('name_en');
            $table->string('calc_type', 10)->default('flat');
            $table->bigInteger('amount');
            $table->unsignedSmallInteger('unit_minutes')->nullable();
            $table->foreignId('vehicle_class_id')->nullable()->constrained()->nullOnDelete();
            $table->time('applies_from')->nullable();
            $table->time('applies_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('holiday_dates', function (Blueprint $table) {
            $table->id();
            $table->date('date')->unique();
            $table->string('name');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('holiday_dates');
        Schema::dropIfExists('surcharges');
        Schema::dropIfExists('tariffs');
        Schema::dropIfExists('ferry_routes');
        Schema::dropIfExists('locations');
        Schema::dropIfExists('zones');
    }
};

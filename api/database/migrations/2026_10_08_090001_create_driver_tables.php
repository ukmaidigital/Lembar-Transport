<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('partner_organizations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type', 20)->default('koperasi');
            $table->string('legal_number')->nullable();
            $table->string('contact_phone', 32)->nullable();
            $table->text('address')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('vehicle_classes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name_id');
            $table->string('name_en');
            $table->string('example_vehicles')->nullable();
            $table->unsignedSmallInteger('max_passengers');
            $table->unsignedSmallInteger('max_luggage');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('drivers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('partner_organization_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 30)->default('draft');
            $table->text('nik')->nullable();
            $table->date('birth_date')->nullable();
            $table->text('address')->nullable();
            $table->string('emergency_contact_name')->nullable();
            $table->string('emergency_contact_phone', 32)->nullable();
            $table->boolean('is_online')->default(false);
            $table->timestamp('last_seen_at')->nullable();
            $table->decimal('last_lat', 10, 7)->nullable();
            $table->decimal('last_lng', 10, 7)->nullable();
            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->unsignedInteger('trips_completed')->default(0);
            $table->decimal('acceptance_rate_30d', 5, 2)->default(100);
            $table->decimal('on_time_rate_90d', 5, 2)->default(100);
            $table->bigInteger('balance')->default(0);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('suspended_at')->nullable();
            $table->string('suspension_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['status', 'is_online']);
        });

        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_class_id')->constrained();
            $table->string('brand');
            $table->string('model');
            $table->unsignedSmallInteger('year');
            $table->string('plate_number', 20)->unique();
            $table->string('color')->nullable();
            $table->unsignedSmallInteger('seats');
            $table->unsignedSmallInteger('luggage_capacity');
            $table->boolean('has_child_seat')->default(false);
            $table->boolean('has_roof_rack')->default(false);
            $table->date('stnk_expires_at')->nullable();
            $table->date('kir_expires_at')->nullable();
            $table->string('status', 20)->default('pending');
            $table->boolean('is_primary')->default(true);
            $table->timestamps();
        });

        Schema::create('driver_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 30);
            $table->string('file_path');
            $table->string('file_hash', 64)->nullable();
            $table->text('document_number')->nullable();
            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->string('status', 20)->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('rejection_reason_code', 50)->nullable();
            $table->text('rejection_note')->nullable();
            $table->unsignedSmallInteger('version')->default(1);
            $table->timestamps();
            $table->index(['driver_id', 'type', 'status']);
        });

        Schema::create('driver_bank_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->string('bank_code', 20);
            $table->text('account_number');
            $table->string('account_name');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
        });

        Schema::create('driver_availability', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->boolean('is_blocked')->default(true);
            $table->string('note')->nullable();
            $table->timestamps();
            $table->unique(['driver_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_availability');
        Schema::dropIfExists('driver_bank_accounts');
        Schema::dropIfExists('driver_documents');
        Schema::dropIfExists('vehicles');
        Schema::dropIfExists('drivers');
        Schema::dropIfExists('vehicle_classes');
        Schema::dropIfExists('partner_organizations');
    }
};

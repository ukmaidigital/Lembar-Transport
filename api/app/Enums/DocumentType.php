<?php

namespace App\Enums;

enum DocumentType: string
{
    case Ktp = 'ktp';
    case Sim = 'sim';
    case Stnk = 'stnk';
    case Skck = 'skck';
    case Kir = 'kir';
    case SelfieKtp = 'selfie_ktp';
    case VehiclePhoto = 'vehicle_photo';
    case BankAccount = 'bank_account';
    case Npwp = 'npwp';

    /** @return self[] */
    public static function required(): array
    {
        return [self::Ktp, self::Sim, self::Stnk, self::Skck, self::SelfieKtp, self::VehiclePhoto, self::BankAccount];
    }

    public function label(): string
    {
        return match ($this) {
            self::Ktp => 'KTP',
            self::Sim => 'SIM A',
            self::Stnk => 'STNK',
            self::Skck => 'SKCK',
            self::Kir => 'KIR',
            self::SelfieKtp => 'Selfie dengan KTP',
            self::VehiclePhoto => 'Foto kendaraan',
            self::BankAccount => 'Buku rekening',
            self::Npwp => 'NPWP',
        };
    }

    public function hasExpiry(): bool
    {
        return in_array($this, [self::Sim, self::Stnk, self::Skck, self::Kir], true);
    }
}

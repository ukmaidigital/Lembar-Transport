<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case Cash = 'cash';
    case BankTransfer = 'bank_transfer';
    case Gateway = 'gateway';

    public function isPrepaid(): bool
    {
        return $this !== self::Cash;
    }
}

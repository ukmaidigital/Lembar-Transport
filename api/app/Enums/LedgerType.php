<?php

namespace App\Enums;

enum LedgerType: string
{
    case TripEarning = 'trip_earning';
    case Commission = 'commission';
    case WaitingFee = 'waiting_fee';
    case CancellationCompensation = 'cancellation_compensation';
    case TopUp = 'top_up';
    case Payout = 'payout';
    case Adjustment = 'adjustment';
}

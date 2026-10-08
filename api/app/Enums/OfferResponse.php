<?php

namespace App\Enums;

enum OfferResponse: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Declined = 'declined';
    case Expired = 'expired';
    case Superseded = 'superseded';
}

<?php

namespace App\Enums;

enum ActorType: string
{
    case Customer = 'customer';
    case Driver = 'driver';
    case Admin = 'admin';
    case System = 'system';
}

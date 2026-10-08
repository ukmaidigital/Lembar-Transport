<?php

namespace App\Enums;

enum DriverStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
    case RevisionRequired = 'revision_required';
    case Active = 'active';
    case Suspended = 'suspended';
    case Rejected = 'rejected';
    case Inactive = 'inactive';
}

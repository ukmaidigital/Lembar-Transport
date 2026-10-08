<?php

namespace App\Exceptions;

use RuntimeException;

/** A violated business rule; rendered as {"error": {"code", "message"}} with the given HTTP status. */
class BusinessRuleException extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message, public readonly int $status = 422, public readonly array $details = [])
    {
        parent::__construct($message);
    }

    public function render()
    {
        return response()->json(['error' => ['code' => $this->errorCode, 'message' => $this->getMessage(), 'details' => $this->details]], $this->status);
    }
}

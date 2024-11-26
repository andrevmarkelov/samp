<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Waiting = 'waiting';
    case Success = 'success';
    case Error = 'error';

    /**
     * Описание статусов
     *
     * @return string
     */
    public function description(): string
    {
        return match($this) {
            self::Waiting => 'Платеж ожидает обработки.',
            self::Success => 'Платеж успешно завершен.',
            self::Error => 'Во время платежа произошла ошибка.',
        };
    }
}

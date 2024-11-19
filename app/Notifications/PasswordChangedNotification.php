<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordChangedNotification extends Notification
{
    use Queueable;

    /**
     * Создает новый экземпляр уведомления.
     */
    public function __construct()
    {
        //
    }

    /**
     * Уведомление должно отправляться в один или несколько каналов.
     * В данном случае используется почтовый канал.
     *
     * @param object $notifiable
     * @return string[]
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Создаёт сообщение для отправки на почту.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Ваш пароль был изменён')
            ->greeting("Здравствуйте, {$notifiable->username}")
            ->line('Ваш пароль был успешно изменён.')
            ->line('Если вы не совершали это действие, немедленно свяжитесь с нашей поддержкой.')
            ->action('Связаться с поддержкой', url('/contact'))
            ->line('Спасибо, что пользуетесь нашим сервисом!');
    }

    /**
     * Получает представление массива уведомлений.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            //
        ];
    }
}

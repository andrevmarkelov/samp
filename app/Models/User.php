<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Атрибуты, которые можно массово заполнять
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'p_level',
        'p_skin',
        'p_money',
        'p_donate',
    ];

    /**
     * Атрибуты, которые скрыты при сериализации
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Преобразование атрибутов в указанные типы
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
        ];
    }

    /**
     * Связь "один ко многим" с моделью House
     * У одного пользователя может быть несколько домов
     *
     * @return HasMany
     */
    public function houses(): HasMany
    {
        return $this->hasMany(House::class);
    }

    /**
     * Связь "один ко многим" с моделью Business
     *
     * @return HasMany
     */
    public function businesses(): HasMany
    {
        return $this->hasMany(Business::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class House extends Model
{
    use HasFactory;

    /**
     * Указываем поля, которые можно заполнять массово
     * Это защищает от "массового присвоения" нежелательных данных
     *
     * @var string[] $fillable
     */
    protected $fillable = [
        'name',
        'description',
        'price',
        'entrance_x',
        'entrance_y',
        'entrance_z',
        'user_id',
    ];

    /**
     * Связь "многие к одному" с моделью User
     * Каждый дом может принадлежать одному пользователю, но может и не принадлежать никому (если в продаже)
     *
     * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

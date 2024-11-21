<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Business extends Model
{
    /**
     * Указываем поля, которые можно заполнять массово
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
     *
     * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

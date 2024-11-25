<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{

    /**
     * Определяем, авторизован ли пользователь для выполнения этого запроса.
     *
     * @return Authenticatable|false
     */
    public function authorize(): Authenticatable|false
    {
        return auth('admin')->user() ?? false;
    }

    /**
     * Правила валидации для обновления пользователя.
     *
     * @return array<string, ValidationRule|array|string>
     */
    public function rules(): array
    {
        return [
            'username' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $this->user->id,
            'password' => 'nullable|string|min:6',
            'p_level' => 'required|integer|min:1',
            'p_skin' => 'required|integer|min:1',
            'p_money' => 'required|integer|min:0',
            'p_donate' => 'required|integer|min:0',
        ];
    }

    /**
     * Кастомные сообщения об ошибках.
     */
    public function messages(): array
    {
        return [
            'username.required' => 'Никнейм пользователя обязателен.',
            'email.required' => 'Электронная почта обязательна.',
            'email.unique' => 'Пользователь с таким адресом электронной почты уже существует.',
            'password.min' => 'Пароль должен содержать минимум 6 символов.',
            'p_level.min' => 'Уровень должен быть не меньше 1.',
            'p_money.min' => 'Количество денег должно быть не меньше 0.',
        ];
    }
}

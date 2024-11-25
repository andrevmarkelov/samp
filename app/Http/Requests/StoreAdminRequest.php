<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreAdminRequest extends FormRequest
{

    /**
     * Определяет, авторизован ли пользователь отправлять этот запрос.
     *
     * @return Authenticatable|false
     */
    public function authorize(): Authenticatable|false
    {
        return auth('admin')->user() ?? false;
    }

    /**
     * Правила валидации для создания администратора.
     *
     * @return array<string, ValidationRule|array|string>
     */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:admins,email',
            'password' => 'required|string|min:8|confirmed',
        ];
    }

    /**
     * Сообщения об ошибках валидации.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Имя обязательно для заполнения.',
            'email.required' => 'Email обязателен для заполнения.',
            'email.unique' => 'Этот email уже используется.',
            'password.required' => 'Пароль обязателен для заполнения.',
            'password.confirmed' => 'Подтверждение пароля не совпадает.',
        ];
    }
}

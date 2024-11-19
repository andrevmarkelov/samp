<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ChangePasswordRequest extends FormRequest
{
    /**
     * Определяет, авторизован ли пользователь для выполнения запроса.
     */
    public function authorize(): bool
    {
        return session()->has('user'); //  Проверяем, что пользователь авторизован
    }

    /**
     * Правила валидации для смены пароля.
     *
     * @return array<string, ValidationRule|array|string>
     */
    public function rules(): array
    {
        return [
            'current_password' => 'required',
            'new_password' => 'required|min:6|confirmed',
        ];
    }

    /**
     * Сообщения об ошибках валидации.
     *
     * @return string[]
     */
    public function messages(): array
    {
        return [
            'current_password.required' => 'Введите текущий пароль.',
            'new_password.required' => 'Введите новый пароль.',
            'new_password.min' => 'Новый пароль должен содержать минимум 6 символов.',
            'new_password.confirmed' => 'Подтверждение пароля не совпадает.',
        ];
    }
}

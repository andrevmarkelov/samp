<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class PaymentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array|string>
     */
    public function rules(): array
    {
        return [
            'username' => 'required|string|max:255|exists:users,username',
            'email' => 'required|email|max:255',
            'amount' => 'required|numeric|min:1',
        ];
    }

    public function messages()
    {
        return [
            'username.exists' => 'Пользователь с таким никнеймом не найден',
        ];
    }
}

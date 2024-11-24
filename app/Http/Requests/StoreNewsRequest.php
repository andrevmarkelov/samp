<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreNewsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return Authenticatable|false
     */
    public function authorize(): Authenticatable|false
    {
        return auth('admin')->user() ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array|string>
     */
    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:news,slug',
            'image' => 'nullable|file|mimes:jpeg,png,jpg,gif|max:2048',
            'short_description' => 'nullable|string|max:500',
            'description' => 'required|string',
            'status' => 'required|in:draft,published',
        ];
    }

    /**
     * @return string[]
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Поле "Заголовок" обязательно для заполнения.',
            'title.max' => 'Поле "Заголовок" не должно превышать 255 символов.',
            'slug.required' => 'Поле "Slug" обязательно для заполнения.',
            'slug.max' => 'Поле "Slug" не должно превышать 255 символов.',
            'slug.unique' => 'Такой "Slug" уже существует.',
            'short_description.max' => 'Поле "Краткое описание" не должно превышать 500 символов.',
            'description.required' => 'Поле "Описание" обязательно для заполнения.',
            'status.required' => 'Поле "Статус" обязательно для заполнения.',
            'status.in' => 'Поле "Статус" должно быть одним из следующих значений: draft (черновик) или published (опубликован).',
        ];
    }
}

<?php

namespace App\Http\Controllers;

use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Password;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class ForgotPasswordController extends Controller
{
    /**
     * Отправление ссылки на почту
     *
     * @param Request $request
     * @return Response|RedirectResponse
     */
    public function __invoke(Request $request): Response|RedirectResponse
    {
        try {
            $request->validate(
                ['email' => 'required|email|exists:users'],
                ['email.exists' => 'Пользователь с таким email не зарегистрирован.']
            );

            $status = Password::sendResetLink(
                $request->only('email')
            );

            return response(['status' => $status, 'response' => $status === Password::RESET_LINK_SENT ? 'Письмо отправлено на вашу почту' : 'Ошибка']);

        } catch (Exception $e) {
            return response(['status' => 'error', 'response' => [$e->getMessage()]], HttpResponse::HTTP_BAD_REQUEST);
        }
    }
}

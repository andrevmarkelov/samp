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
            $request->validate(['email' => 'required|email|exists:users']);

            $status = Password::sendResetLink(
                $request->only('email')
            );

            return $status === Password::RESET_LINK_SENT
                ? back()->with(['status' => __($status)])
                : back()->withErrors(['email' => __($status)]);

        } catch (Exception $e) {
            return response(['status' => 'error', 'response' => [$e->getMessage()]], HttpResponse::HTTP_BAD_REQUEST);
        }
    }
}

<?php

namespace App\Http\Controllers;

use App\Http\Requests\UserAuthRequest;
use App\Models\User;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Session;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class AuthController extends Controller
{
    /**
     * Авторизация в личный кабинет пользователя
     *
     * @param UserAuthRequest $request
     * @return Response|RedirectResponse
     */
    public function login(UserAuthRequest $request): Response|RedirectResponse
    {
        try {
            $hashedPassword = md5($request->password);

            $user = User::where('username', $request->username)
                ->where('password', $hashedPassword)
                ->first();

            if ($user) {
                Session::put('user', $user->id);
                return redirect()->route('profile.index');
            }

            return response(['status' => 'error', 'response' => 'Неверный никнейм или пароль.'], HttpResponse::HTTP_UNAUTHORIZED);
        } catch (Exception $e) {
            return response(['status' => 'error', 'response' => [$e->getMessage()]], HttpResponse::HTTP_BAD_REQUEST);
        }
    }

    /**
     * Выход пользователя из системы
     *
     * @param Request $request
     * @return Response|RedirectResponse
     */
    public function logout(Request $request): Response|RedirectResponse
    {
        try {
            $request->session()->forget('user');

            return redirect()->route('home');
        } catch (Exception $e) {
            return response(['status' => 'error', 'response' => [$e->getMessage()]], HttpResponse::HTTP_BAD_REQUEST);
        }
    }
}

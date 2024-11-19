<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChangePasswordRequest;
use App\Models\User;
use App\Notifications\PasswordChangedNotification;
use Exception;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Response;
use Illuminate\Routing\Redirector;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class ProfileController extends Controller
{
    /**
     * Главная страница личного кабинета
     *
     * @return View|Response|Redirector
     */
    public function index(): View|Response|Redirector
    {
        try {
            $userId = session('user');

            if (!$userId) {
                return redirect('/');
            }

            $user = User::find($userId);
            return view('profile.index', compact('user'));
        } catch (Exception $e) {
            return response(['status' => 'error', 'response' => [$e->getMessage()]], HttpResponse::HTTP_BAD_REQUEST);
        }
    }

    public function settings()
    {
        return view('profile.settings');
    }

    /**
     * Изменение пароля для пользователя
     *
     * @param ChangePasswordRequest $request
     * @return Response
     */
    public function changePassword(ChangePasswordRequest $request): Response
    {
        try {
            $userId = session('user');
            $user = User::find($userId);

            if (!$user || $user->password !== md5($request->current_password)) {
                return response(['status' => 'error', 'errors' => ['current_password' => ['Текущий пароль неверен.']]], HttpResponse::HTTP_UNPROCESSABLE_ENTITY);
            }

            $user->update(['password' => md5($request->new_password)]);
            $user->notify(new PasswordChangedNotification());

            return response(['status' => 'success', 'response' => 'Пароль успешно изменён.']);
        } catch (Exception $e) {
            return response(['status' => 'error', 'response' => [$e->getMessage()]], HttpResponse::HTTP_BAD_REQUEST);
        }
    }
}

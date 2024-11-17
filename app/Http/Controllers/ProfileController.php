<?php

namespace App\Http\Controllers;

use App\Models\User;
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
}

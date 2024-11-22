<?php

namespace App\Http\Controllers;

use App\Http\Requests\PaymentRequest;
use App\Models\Payment;
use App\Models\User;
use Exception;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class ShopController extends Controller
{
    /**
     * Страница магазина
     *
     * @return View
     */
    public function index(): View
    {
        return view('shop');
    }

    /**
     * Оплата на странице магазина
     *
     * @param PaymentRequest $request
     * @return Response
     */
    public function processPayment(PaymentRequest $request): Response
    {
        try {
            $validated = $request->validated();
            $user = User::where('username', $validated['username'])->first();

            $payment = Payment::create([
                'user_id' => $user->id,
                'amount' => $validated['amount'],
                'status' => 'waiting',
            ]);

            return response(['status' => 'success', 'response' => ['payment' => $payment]]);
        } catch (Exception $e) {
            return response(['status' => 'error', 'response' => [$e->getMessage()]], HttpResponse::HTTP_BAD_REQUEST);
        }
    }
}

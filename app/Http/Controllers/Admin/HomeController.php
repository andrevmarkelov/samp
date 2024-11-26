<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\House;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Contracts\View\View;

class HomeController extends Controller
{

    /**
     * Главная страница Админки
     *
     * @return View
     */
    public function index(): View
    {
        $users = User::count();
        $houses = House::count();
        $businesses = Business::count();

        $totalRevenue = Payment::where('status', PaymentStatus::Success->value)
            ->sum('amount');

        return view('admin.home', [
            'users' => $users,
            'houses' => $houses,
            'businesses' => $businesses,
            'totalRevenue' => $totalRevenue
        ]);
    }
}

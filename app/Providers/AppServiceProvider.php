<?php

namespace App\Providers;

use App\Models\User;
use App\View\Composers\HeaderComposer;
use App\View\Composers\ProfileMenuComposer;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        ResetPassword::createUrlUsing(function (User $user, string $token) {
            return env('APP_URL') . 'auth/reset-password?token=' . $token;
        });

        View::composer('inc.header', HeaderComposer::class);
        View::composer('inc.profile-menu', ProfileMenuComposer::class);

        View::share('serverName', config('app.samp_server_name'));
        View::share('serverIP', config('app.samp_server_ip'));
    }
}

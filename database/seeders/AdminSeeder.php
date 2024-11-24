<?php

namespace Database\Seeders;

use App\Models\Admin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Admin::create([
            'name' => env('SUPER_ADMIN_NAME', 'Super_Admin'),
            'email' => env('MAIL_FROM_ADDRESS', 'samp@example.ru'),
            'password' => Hash::make(env('SUPER_ADMIN_PASSWORD', 'password')),
        ]);
    }
}

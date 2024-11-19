@extends('layouts.profile')

@section('profile-content')
    <div class="profile-statistics">
        <h1 class="h3 text-center mb-3">Общая информация</h1>
        <p><strong>Уровень:</strong> {{ $user->p_level  }}</p>
        <p><strong>Наличные деньги:</strong> {{ $user->p_money  }}$</p>
        <p><strong>Донат счет:</strong> {{ $user->p_donate  }} руб.</p>
        <p><strong>Email:</strong> {{ $user->email  }}</p>
    </div>
@endsection

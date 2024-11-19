@extends('layouts.profile')

@section('profile-content')
    <div class="profile-content">
        <p>Уровень: {{ $user->p_level  }}</p>
        <p>Деньги: {{ $user->p_money  }}</p>
        <p>Донат счет: {{ $user->p_donate  }}</p>
        <p>Email: {{ $user->email  }}</p>
    </div>
@endsection

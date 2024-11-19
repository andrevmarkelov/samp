@extends('layouts.app')

@section('content')
    <div class="container py-4">
        <div class="row">
            <div class="col-md-3">
                @include('inc.profile-menu')
            </div>

            <div class="col-md-9">
                @yield('profile-content')
            </div>
        </div>
    </div>
@endsection

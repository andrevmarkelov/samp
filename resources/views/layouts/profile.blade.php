@extends('layouts.app')

@section('content')
    <div class="profile-page">
        <div class="container py-5">
            <div class="row">
                <div class="col-md-3">
                    <div class="profile-card">
                        @include('inc.profile-menu')
                    </div>
                </div>

                <div class="col-md-9">
                    <div class="profile-card">
                        @yield('profile-content')
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection

@extends('layouts.app')

@section('content')
    <div class="profile-page">
        <div class="container py-5">
            <div class="row">
                <div class="col-12 col-md-4 col-lg-3">
                    <div class="profile-card mb-5">
                        @include('inc.profile-menu')
                    </div>
                </div>

                <div class="col-12 col-md-8 col-lg-9">
                    <div class="profile-card">
                        @yield('profile-content')
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection

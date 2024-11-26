@extends('layouts.app')

@section('content')
    <div class="article-page">
        <div class="article-content ">
            <div class="article-content__background"></div>
            <div class="container py-5">
                <div class="row">
                    <div class="col-md-8 mx-auto">
                        <div class="news-details">
                            <h1 class="mb-3 text-center color-dark-blue">{{ $news->title }}</h1>

                            <div class="d-flex align-items-center justify-content-center gap-5 mb-5">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="bi bi-person text-muted"></i>
                                    <small class="text-muted mb-0">{{ $serverName }}</small>
                                </div>

                                <div class="d-flex align-items-center gap-2">
                                    <i class="bi bi-calendar3 text-muted"></i>
                                    <small class="text-muted mb-0">{{ $news->created_at->format('d.m.Y') }}</small>
                                </div>
                            </div>

                            <div class="mb-3">
                                <img src="{{ asset('storage/' . $news->image) }}" alt="{{ $news->title }}" class="w-100 rounded-top">
                            </div>

                            <div class="news-short__description mb-5 mt-5 fst-italic">
                                {{ $news->short_description }}
                            </div>

                            <div class="news-content">
                                {!! $news->description !!}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection

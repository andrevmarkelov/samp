@extends('layouts.profile')

@section('profile-content')
    <div>
        <h1 class="h3 text-center mb-3">История платежей</h1>

        <div class="table-responsive">
            <table class="table table-striped table-hover table-sm">
                <thead>
                <tr>
                    <th scope="col">#</th>
                    <th scope="col">Сумма</th>
                    <th scope="col">Статус</th>
                    <th scope="col">Дата</th>
                </tr>
                </thead>
                <tbody>
                @forelse($payments as $payment)
                    <tr>
                        <th scope="row">{{ $payment->id }}</th>
                        <td>{{ number_format($payment->amount, 2) }}</td>
                        <td>{{ $payment->status->description() }}</td>
                        <td>{{ $payment->created_at->format('d.m.Y') }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="4" class="text-center">Ваша история платежей пока пуста.</td>
                    </tr>
                @endforelse
                </tbody>
            </table>
        </div>

        <!-- Пагинация -->
        <nav class="d-flex justify-content-center mt-4">
            <ul class="pagination">
                <li class="page-item {{ $payments->onFirstPage() ? 'disabled' : '' }}">
                    <a class="page-link" href="{{ $payments->previousPageUrl() }}" aria-label="Previous">
                        <span aria-hidden="true">&laquo;</span>
                    </a>
                </li>

                @foreach ($payments->getUrlRange(1, $payments->lastPage()) as $page => $url)
                    <li class="page-item {{ $page == $payments->currentPage() ? 'active' : '' }}">
                        <a class="page-link" href="{{ $url }}">{{ $page }}</a>
                    </li>
                @endforeach

                <li class="page-item {{ $payments->hasMorePages() ? '' : 'disabled' }}">
                    <a class="page-link" href="{{ $payments->nextPageUrl() }}" aria-label="Next">
                        <span aria-hidden="true">&raquo;</span>
                    </a>
                </li>
            </ul>
        </nav>
    </div>
@endsection

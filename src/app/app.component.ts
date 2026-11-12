import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { LinksService, Link } from './links.service';

const httpUrlValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  try {
    const url = new URL(control.value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? null : { invalidUrl: true };
  } catch {
    return { invalidUrl: true };
  }
};

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly linksService = inject(LinksService);

  readonly links = signal<Link[]>([]);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly loadError = signal('');
  readonly submitError = signal('');
  readonly form = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, httpUrlValidator]
  });

  ngOnInit(): void {
    this.loadLinks();
  }

  submit(): void {
    this.submitError.set('');
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.linksService.create(this.form.value.trim()).subscribe({
      next: (link) => {
        this.links.update((links) => [link, ...links]);
        this.form.reset('');
        this.isSubmitting.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.submitError.set(this.getErrorMessage(error));
        this.isSubmitting.set(false);
      }
    });
  }

  loadLinks(): void {
    this.isLoading.set(true);
    this.loadError.set('');
    this.linksService.list().subscribe({
      next: (links) => {
        this.links.set(links);
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loadError.set(this.getErrorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Unable to reach the API. Check that the backend is running.';
    }

    if (typeof error.error === 'object' && error.error !== null && 'error' in error.error) {
      const message = (error.error as Record<string, unknown>)['error'];
      if (typeof message === 'string') {
        return message;
      }
    }

    return error.message || 'The request could not be completed.';
  }
}

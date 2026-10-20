import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { DialogHost } from './shared/ui/dialog-host';
import { EmailPreview } from './shared/ui/email-preview';
import { ToastHost } from './shared/ui/toast-host';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost, DialogHost, EmailPreview],
  templateUrl: './app.html',
})
export class App {
  constructor() {
    inject(ThemeService);
  }
}

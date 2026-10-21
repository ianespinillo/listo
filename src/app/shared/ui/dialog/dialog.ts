import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';

let nextDialogId = 0;

/**
 * Diálogo modal sobre el `<dialog>` nativo. El estado vive en `open` (`[(open)]="…"`): al pasar a
 * true se abre con `showModal()` y al pasar a false se cierra. El navegador se ocupa del foco
 * atrapado y de Escape; acá solo se sincroniza `open`, se emite `closed` y se devuelve el foco al
 * elemento que lo tenía antes de abrir.
 *
 * El título (`title`) es el nombre accesible (`aria-labelledby`). Si el cuerpo tiene un texto que lo
 * describe, `describedBy` recibe el `id` de ese elemento. El contenido (formulario o botones) se proyecta.
 */
@Component({
  selector: 'app-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="dialog"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="describedBy()"
      (close)="onClose()"
    >
      <div class="dialog-body">
        <h2 class="dialog-title" [attr.id]="titleId">{{ title() }}</h2>
        <ng-content />
      </div>
    </dialog>
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Dialog {
  readonly open = model(false);
  readonly title = input.required<string>();
  readonly describedBy = input<string | null>(null);
  /** Se emite cada vez que el diálogo se cierra, sea cual sea el motivo. */
  readonly closed = output<void>();

  protected readonly titleId = `app-dialog-title-${nextDialogId++}`;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private previouslyFocused: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open()) {
        if (!element.open) {
          this.previouslyFocused = element.ownerDocument.activeElement as HTMLElement | null;
          element.showModal();
        }
      } else if (element.open) {
        element.close();
      }
    });
  }

  /** Evento `close` del navegador: Escape, `close()` o un formulario `method="dialog"`. */
  protected onClose(): void {
    if (this.open()) this.open.set(false);
    this.closed.emit();
    const previous = this.previouslyFocused;
    this.previouslyFocused = null;
    if (previous?.isConnected) previous.focus();
  }
}

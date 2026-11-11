---
title: Usar com Angular
sourceHash: 45537066a981f484
---

Renderize emojis no Angular por meio do elemento `<fluent-emoji>`. Não existe um
adaptador nativo para Angular; o elemento funciona em qualquer versão do Angular
que suporte custom elements.

## Registre o elemento

Importe o entry do elemento uma única vez, por exemplo em `main.ts`. Ao
importá-lo, ele registra `<fluent-emoji>`. O elemento traz os próprios estilos
em um shadow root, então não há nenhuma folha de estilo para importar:

```ts
import "animated-fluent-emojis/element";
```

## Permita a tag nos seus componentes

O Angular rejeita tags desconhecidas, a menos que o componente permita custom
elements:

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";

@Component({
  selector: "app-greeting",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<fluent-emoji id="1f44b_wavinghand" size="64" play-on-hover />`,
})
export class GreetingComponent {}
```

## Vincule propriedades e escute eventos

Use property bindings para valores dinâmicos, assim o Angular define as
propriedades do elemento em vez de reescrever atributos. Os eventos são
`emoji-load`, `emoji-error` e `playback-end`:

```html
<fluent-emoji [id]="emojiId" [size]="64" [playOnHover]="true" (playback-end)="onDone()">
  <span slot="fallback">👋</span>
</fluent-emoji>
```

Atributos, propriedades e eventos estão listados no
[guia de uso](../guide/frameworks.md#plain-html). Para reservar o espaço do
emoji antes de o elemento ser atualizado, adicione
`FLUENT_EMOJI_PRE_UPGRADE_CSS` ao seu CSS global. Para o comportamento de
carregamento, fallback e reprodução, veja o restante do
[guia de uso](../usage.md).

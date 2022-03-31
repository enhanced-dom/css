export class UnknownStylesheetEvent<T extends { emitter: { type: string; id?: string } }> extends CustomEvent<
  { stylesheetName: string } & T
> {
  static type = 'UnknownStylesheet'
  constructor(stylesheetName: string, context: T) {
    super(UnknownStylesheetEvent.type, { detail: { stylesheetName, ...context } })
  }
}

export class UnknownCssRuleEvent<T extends { emitter: { type: string; id?: string } }> extends CustomEvent<
  { stylesheetName: string; selector: string } & T
> {
  static type = 'UnknownCssRule'
  constructor(stylesheetName: string, selector: string, context: T) {
    super(UnknownCssRuleEvent.type, { detail: { stylesheetName, selector, ...context } })
  }
}

export class StylesheetsRepository {
  static eventEmitterType = '@enhanced-dom/stylesheetsRepository'
  private _document: ShadowRoot | Document
  private _emitter: { type: string; id?: string }
  constructor(document: ShadowRoot | Document, emitter: { type: string; id?: string } = { type: StylesheetsRepository.eventEmitterType }) {
    this._document = document
    this._emitter = emitter
  }

  public getStylesheet(stylesheetName: string) {
    const stylesheet = Array.from(this._document.styleSheets).find(
      (s) => (s.title ?? (s.ownerNode as Element).getAttribute('title')) === stylesheetName,
    )
    if (!stylesheet) {
      this._document.dispatchEvent(
        new UnknownStylesheetEvent(stylesheetName, { emitter: this._emitter }),
      )
    }
    return stylesheet
  }

  private _refreshStylesheet(stylesheetName: string) {
    const stylesheet = this.getStylesheet(stylesheetName)
    if (stylesheet) {
      const newCss = Array.from(stylesheet.cssRules)
        .map((rule) => rule.cssText)
        .join('')
      ;(stylesheet.ownerNode as Element).innerHTML = newCss
    }
  }

  public getRule(stylesheetName: string, selector: string): CSSStyleRule {
    const stylesheet = this.getStylesheet(stylesheetName)
    if (!stylesheet) {
      return undefined
    }
    const rule = Array.from(stylesheet.cssRules).find((r: CSSStyleRule) => r.selectorText.endsWith(selector)) as CSSStyleRule
    if (!rule) {
      this._document.dispatchEvent(
        new UnknownCssRuleEvent(stylesheetName, selector, { emitter: this._emitter }),
      )
    }
    return rule
  }

  setProperty(stylesheetName: string, selector: string, variableName: string, value: string) {
    const rule = this.getRule(stylesheetName, selector)
    if (rule) {
      rule.style.setProperty(variableName, value)
      this._refreshStylesheet(stylesheetName)
    }
  }

  getProperty(stylesheetName: string, selector: string, variableName: string) {
    const rule = this.getRule(stylesheetName, selector)
    if (rule) {
      return rule.style.getPropertyValue(variableName)
    }
    return undefined
  }
}

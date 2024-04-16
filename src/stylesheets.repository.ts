import { STYLESHEET_ATTRIBUTE_NAME } from './constants'

export interface IStylesheetsRepository {
  getStylesheet(stylesheetName: string, strict?: boolean): CSSStyleSheet | null
  getOrCreateStylesheet(stylesheetName: string): CSSStyleSheet
  createOrUpdateStylesheet(stylesheetName: string, contents: string): void
  getRule(stylesheetName: string, selector: string, strict?: boolean): CSSStyleRule | null
  getOrCreateRule(stylesheetName: string, selector: string): CSSStyleRule
  createOrUpdateRule(stylesheetName: string, selector: string, contents: string): void
  setProperty(stylesheetName: string, selector: string, variableName: string, value: string): void
  getProperty(stylesheetName: string, selector: string, variableName: string, strict?: boolean): string
}

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

type DomBoundCSSStyleSheetType = CSSStyleSheet & { ownerNode: Element }

export class StylesheetsRepository implements IStylesheetsRepository {
  static eventEmitterType = '@enhanced-dom/stylesheetsRepository'
  private _document: ShadowRoot | Document
  private _name: string
  constructor(document: ShadowRoot | Document, name = 'Unknown') {
    this._document = document
    this._name = name
  }

  public getStylesheet(stylesheetName: string, strict = true): DomBoundCSSStyleSheetType {
    const stylesheet = Array.from(this._document.styleSheets).find(
      (s) => (s.ownerNode as Element).getAttribute(STYLESHEET_ATTRIBUTE_NAME) === stylesheetName,
    )

    if (!stylesheet && strict) {
      this._document.dispatchEvent(
        new UnknownStylesheetEvent(stylesheetName, { emitter: { type: StylesheetsRepository.eventEmitterType, id: this._name } }),
      )
    }
    return stylesheet as DomBoundCSSStyleSheetType
  }

  public getOrCreateStylesheet(stylesheetName: string) {
    const stylesheet = this.getStylesheet(stylesheetName, false)
    let stylesheetNode = stylesheet?.ownerNode as Element
    if (!stylesheetNode) {
      stylesheetNode = document.createElement('style')
      stylesheetNode.setAttribute(STYLESHEET_ATTRIBUTE_NAME, stylesheetName)
      // try to append at the end of <head> node
      const head = this._document.querySelector('head')
      if (head) {
        head.appendChild(stylesheetNode)
      } else {
        // <head> does not exist
        const documentNodes = Array.from(this._document.childNodes)
        // find first <style> node which is a direct descendent of the topmost level
        const firstStylesheet = documentNodes.find((n: HTMLElement) => n.nodeType === n.ELEMENT_NODE && n.tagName.toLowerCase() === 'style')
        if (firstStylesheet) {
          const subsequentNode = documentNodes.find(
            (n: HTMLElement) => n.nodeType !== n.ELEMENT_NODE || n.tagName.toLowerCase() !== 'style',
            documentNodes.indexOf(firstStylesheet),
          )
          if (subsequentNode) {
            // insert before this first not after the first <style> which is not a style node
            this._document.insertBefore(stylesheetNode, subsequentNode)
          } else {
            // the last node of this document is a <style> - append at the end
            this._document.appendChild(stylesheetNode)
          }
        } else {
          // prepend at the top of the document
          this._document.prepend(stylesheetNode)
        }
      }
    }
    return this.getStylesheet(stylesheetName)
  }

  public createOrUpdateStylesheet(stylesheetName: string, contents: string) {
    const stylesheet = this.getOrCreateStylesheet(stylesheetName)
    ;(stylesheet.ownerNode as Element).innerHTML = contents
  }

  private _serializeStylesheet(stylesheet: CSSStyleSheet) {
    return Array.from(stylesheet.cssRules)
      .map((rule) => rule.cssText)
      .join('')
  }

  private _refreshStylesheet(stylesheet: DomBoundCSSStyleSheetType) {
    const newCss = this._serializeStylesheet(stylesheet)
    stylesheet.ownerNode.innerHTML = newCss
  }

  public getRule(stylesheetName: string, selector: string, strict = true): CSSStyleRule {
    const stylesheet = this.getStylesheet(stylesheetName, strict)
    if (!stylesheet) {
      return undefined
    }
    const rule = Array.from(stylesheet.cssRules)
      .filter((r) => r instanceof CSSStyleRule)
      .find((r: CSSStyleRule) => r.selectorText.endsWith(selector)) as CSSStyleRule
    if (!rule && strict) {
      this._document.dispatchEvent(
        new UnknownCssRuleEvent(stylesheetName, selector, { emitter: { type: StylesheetsRepository.eventEmitterType, id: this._name } }),
      )
    }
    return rule
  }

  public getOrCreateRule(stylesheetName: string, selector: string): CSSStyleRule {
    let rule = this.getRule(stylesheetName, selector, false)
    if (!rule) {
      let stylesheet = this.getOrCreateStylesheet(stylesheetName)
      const newContents = `${this._serializeStylesheet(stylesheet)} ${selector}{}`
      this.createOrUpdateStylesheet(stylesheetName, newContents)
      stylesheet = this.getOrCreateStylesheet(stylesheetName)
      rule = Array.from(stylesheet.cssRules)[stylesheet.cssRules.length - 1] as CSSStyleRule
    }
    return rule
  }

  public createOrUpdateRule(stylesheetName: string, selector: string, contents: string) {
    const rule = this.getOrCreateRule(stylesheetName, selector)
    rule.cssText = contents
    this._refreshStylesheet(rule.parentStyleSheet as DomBoundCSSStyleSheetType)
  }

  public setProperty(stylesheetName: string, selector: string, variableName: string, value: string) {
    const rule = this.getOrCreateRule(stylesheetName, selector)
    rule.style.setProperty(variableName, value)
    this._refreshStylesheet(rule.parentStyleSheet as DomBoundCSSStyleSheetType)
  }

  public getProperty(stylesheetName: string, selector: string, variableName: string, strict = true) {
    const rule = this.getRule(stylesheetName, selector, strict)
    if (!rule) {
      return undefined
    }
    return rule.style.getPropertyValue(variableName)
  }
}

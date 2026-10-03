import type * as React from 'react';
type Node = React.ReactNode;
export interface SkipLinkProps { href?: string; children?: Node; className?: string }
export declare function SkipLink(props: SkipLinkProps): React.ReactElement;
export interface WordmarkProps { name?: string; href?: string; mark?: boolean; className?: string }
export declare function Wordmark(props: WordmarkProps): React.ReactElement;
export interface MastheadProps { wordmark?: Node; navLabel?: string; children?: Node; className?: string }
export declare function Masthead(props: MastheadProps): React.ReactElement;
export interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {}
export declare function NavLink(props: NavLinkProps): React.ReactElement;
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { label: string; size?: 'md' | 'sm'; href?: string }
export declare function IconButton(props: IconButtonProps): React.ReactElement;
export interface LanguageItem { name: string; href?: string; lang?: string; current?: boolean }
export interface LanguageMenuProps { label?: string; title?: string; items: LanguageItem[]; defaultOpen?: boolean; className?: string }
export declare function LanguageMenu(props: LanguageMenuProps): React.ReactElement;
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'outline' | 'primary'; size?: 'md' | 'sm'; href?: string }
export declare function Button(props: ButtonProps): React.ReactElement;
export interface CopyButtonProps { text?: string; getText?: () => string; label?: string; copiedLabel?: string; className?: string }
export declare function CopyButton(props: CopyButtonProps): React.ReactElement;
export interface PromoBarProps { text?: Node; open?: boolean; hidden?: boolean; onClose?: () => void; closeLabel?: string; children?: Node; className?: string }
export declare function PromoBar(props: PromoBarProps): React.ReactElement;
export interface HeroProps { title: Node; lede?: Node; children?: Node; className?: string }
export declare function Hero(props: HeroProps): React.ReactElement;
export interface SectionProps { id?: string; title?: Node; lede?: Node; children?: Node; className?: string }
export declare function Section(props: SectionProps): React.ReactElement;
export interface StepsProps { items: { title: Node; body: Node }[]; className?: string }
export declare function Steps(props: StepsProps): React.ReactElement;
export interface CodeBlockProps { label?: string; children: string; prompt?: boolean; copyLabel?: string; copiedLabel?: string; className?: string }
export declare function CodeBlock(props: CodeBlockProps): React.ReactElement;
export interface NoteProps { title?: Node; children?: Node; className?: string }
export declare function Note(props: NoteProps): React.ReactElement;
export interface FooterProps { children?: Node; social?: Node; meta?: Node; className?: string }
export declare function Footer(props: FooterProps): React.ReactElement;
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { selected?: boolean }
export declare function Chip(props: ChipProps): React.ReactElement;
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; hint?: string; error?: string; errorLabel?: string }
export declare function TextField(props: TextFieldProps): React.ReactElement;
export interface SwitchProps { checked?: boolean; defaultChecked?: boolean; onChange?: (checked: boolean) => void; label?: Node; disabled?: boolean; className?: string }
export declare function Switch(props: SwitchProps): React.ReactElement;
export interface DialogProps { title: Node; children?: Node; actions?: Node; className?: string }
export declare function Dialog(props: DialogProps): React.ReactElement;
export interface SnackbarProps { message: Node; action?: Node; className?: string }
export declare function Snackbar(props: SnackbarProps): React.ReactElement;
export interface SocialCardProps { title: Node; accent?: Node; sub?: Node; url?: string; name?: string; scale?: number; className?: string }
export declare function SocialCard(props: SocialCardProps): React.ReactElement;
declare global { interface Window { Bugra: { SkipLink: typeof SkipLink; Wordmark: typeof Wordmark; Masthead: typeof Masthead; NavLink: typeof NavLink; IconButton: typeof IconButton; LanguageMenu: typeof LanguageMenu; Button: typeof Button; CopyButton: typeof CopyButton; PromoBar: typeof PromoBar; Hero: typeof Hero; Section: typeof Section; Steps: typeof Steps; CodeBlock: typeof CodeBlock; Note: typeof Note; Footer: typeof Footer; Chip: typeof Chip; TextField: typeof TextField; Switch: typeof Switch; Dialog: typeof Dialog; Snackbar: typeof Snackbar; SocialCard: typeof SocialCard } } }

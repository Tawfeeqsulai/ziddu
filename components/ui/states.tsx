import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ActionProps = { title: string; description?: string; actionLabel?: string; onAction?: () => void };

export function Spinner() { return <LoaderCircle aria-label="Loading" className="ui-spinner" size={18} />; }
export function Skeleton({ className = "" }: { className?: string }) { return <span aria-hidden="true" className={`ui-skeleton ${className}`} />; }
export function EmptyState({ title, description, actionLabel, onAction }: ActionProps) { return <div className="ui-state"><Inbox aria-hidden="true" size={28} /><strong>{title}</strong>{description && <p>{description}</p>}{actionLabel && onAction && <Button onClick={onAction} variant="outline">{actionLabel}</Button>}</div>; }
export function ErrorState({ title = "Something went wrong", description, actionLabel = "Try again", onAction }: ActionProps) { return <div className="ui-state ui-error-state"><AlertCircle aria-hidden="true" size={28} /><strong>{title}</strong>{description && <p>{description}</p>}{onAction && <Button onClick={onAction} variant="outline">{actionLabel}</Button>}</div>; }

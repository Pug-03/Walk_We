import { Link, type LinkProps } from 'react-router-dom';
import { useGo } from '../utils/transition.ts';

/** A router Link whose navigation plays the page transition. */
export function TLink({ to, onClick, ...rest }: LinkProps) {
  const go = useGo();
  return (
    <Link
      to={to}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        go(to);
      }}
      {...rest}
    />
  );
}

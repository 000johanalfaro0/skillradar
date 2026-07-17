import { useMe, useVote } from '../hooks';
import { loginUrl } from '../api';

export default function VoteButton({ skillId, count }: { skillId: number; count: number }) {
  const { data } = useMe();
  const vote = useVote();
  const voted = data?.votes.includes(skillId) ?? false;
  const loggedIn = !!data?.user;

  if (!loggedIn) {
    return (
      <a
        href={loginUrl()}
        title="Sign in to vote"
        className="flex items-center gap-1 rounded-md border border-edge px-2 py-1 text-sm text-muted hover:border-accent"
        onClick={(e) => e.stopPropagation()}
      >
        ▲ {count}
      </a>
    );
  }

  return (
    <button
      disabled={vote.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        vote.mutate(skillId);
      }}
      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-sm transition ${
        voted ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-muted hover:border-accent'
      }`}
    >
      ▲ {count}
    </button>
  );
}

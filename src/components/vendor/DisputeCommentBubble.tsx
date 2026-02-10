// FILE: src/components/vendor/DisputeCommentBubble.tsx
"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";

interface DisputeCommentBubbleProps {
  comment: {
    author: "vendor" | "customer" | "admin";
    text?: string;
    createdAt?: any;
    attachments?: string[];
  };
}

function fmtDate(v: any): string {
  try {
    if (!v) return "—";
    if (typeof v === "number") {
      return new Date(v).toLocaleString("en-NG", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return String(v);
  } catch {
    return "—";
  }
}

const AUTHOR_CONFIG = {
  vendor: {
    label: "You",
    bubble: "bg-orange-500 text-white",
    align: "justify-end",
  },
  admin: {
    label: "Admin",
    bubble: "bg-blue-50 border border-blue-200 text-blue-900",
    align: "justify-start",
  },
  customer: {
    label: "Customer",
    bubble: "bg-gray-100 text-gray-900",
    align: "justify-start",
  },
};

export const DisputeCommentBubble = memo(function DisputeCommentBubble({
  comment,
}: DisputeCommentBubbleProps) {
  const config = AUTHOR_CONFIG[comment.author] || AUTHOR_CONFIG.customer;

  return (
    <div className={cn("flex", config.align)}>
      <div className={cn("max-w-[85%] rounded-2xl p-3", config.bubble)}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold opacity-90">{config.label}</span>
          <span className="text-xs opacity-70">
            {fmtDate(comment.createdAt)}
          </span>
        </div>

        {comment.text && (
          <p className="text-sm whitespace-pre-wrap">{comment.text}</p>
        )}

        {comment.attachments && comment.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {comment.attachments.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-16 h-16 rounded-lg overflow-hidden border border-white/20 hover:border-white/50 transition"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Attachment ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
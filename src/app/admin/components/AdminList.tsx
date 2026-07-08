"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";

export function AdminList() {
  const [email, setEmail] = useState("");
  const { data: admins, isLoading, refetch } = api.admin.all.useQuery();
  const addMutation = api.admin.add.useMutation();
  const removeMutation = api.admin.remove.useMutation();

  const addAdmin = () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    addMutation.mutate(
      { email: trimmed },
      {
        onSuccess: () => {
          toast.success(`Added ${trimmed.toLowerCase()} as an admin!`);
          setEmail("");
          refetch();
        },
        onError: (error) => {
          toast.error(`Failed to add admin: ${error.message}`);
        },
      },
    );
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Admins</h2>
      </div>
      <Card className="border-border">
        <CardContent className="flex flex-col gap-2 p-4">
          <p className="text-sm text-muted-foreground">
            Google accounts allowed to sign in to this dashboard.
          </p>
          {isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            admins?.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5"
              >
                <span className="line-clamp-1 text-sm">{admin.email}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${admin.email}`}
                  onClick={() => {
                    removeMutation.mutate(
                      { id: admin.id },
                      {
                        onSuccess: () => {
                          toast.success(`Removed ${admin.email}!`);
                          refetch();
                        },
                        onError: (error) => {
                          toast.error(
                            `Failed to remove admin: ${error.message}`,
                          );
                        },
                      },
                    );
                  }}
                >
                  <Trash2Icon className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addAdmin();
            }}
          >
            <Input
              type="email"
              placeholder="someone@tinkertanker.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={addMutation.isPending}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Admin
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

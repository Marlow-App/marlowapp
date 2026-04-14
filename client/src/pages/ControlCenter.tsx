import { useState } from "react";
import { Layout } from "@/components/Layout";
import { usePendingRecordings } from "@/hooks/use-recordings";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic, PlayCircle, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ControlCenter() {
  const { data: pendingRecordings, isLoading } = usePendingRecordings();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 animate-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display">Control Center</h1>
            <p className="text-muted-foreground mt-1">Review pending recordings from learners</p>
          </div>
          <Badge className="px-3 py-1 text-base bg-primary text-white">
            {pendingRecordings?.length || 0} Pending
          </Badge>
        </div>

        <div className="grid gap-4">
          {pendingRecordings?.map((recording) => (
            <Card key={recording.id} className="hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 text-secondary-foreground flex items-center justify-center shrink-0">
                      <Mic className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-medium mb-1">{recording.sentenceText}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                         <span>Submitted {formatDistanceToNow(new Date(recording.createdAt), { addSuffix: true })}</span>
                         <span>•</span>
                         <span>ID: #{recording.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="hidden md:block w-32 h-10 bg-muted/50 rounded-full overflow-hidden relative">
                      {/* Fake waveform visual */}
                      <div className="absolute inset-y-0 left-0 w-1/3 bg-primary/20"></div>
                      <div className="flex items-center justify-center gap-1 h-full px-4">
                         {[...Array(10)].map((_, i) => (
                           <div key={i} className="w-1 bg-muted-foreground/30 rounded-full" style={{ height: `${Math.random() * 80 + 20}%`}}></div>
                         ))}
                      </div>
                    </div>
                    
                    <Link href={`/recordings/${recording.id}`}>
                      <Button className="w-full md:w-auto group">
                        Review Now
                        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {(!pendingRecordings || pendingRecordings.length === 0) && (
            <div className="text-center py-20 bg-muted/10 rounded-2xl border border-dashed border-border">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <PlayCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium">All caught up!</h3>
              <p className="text-muted-foreground mt-2">No pending recordings to review.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

import { driveStatus, findRoomByName, getClientStudio, nextBestSlot } from "@bolo/core";
import { CreateView } from "@/components/studio/create-view";
import { aiLabel } from "@/lib/connections";

export default async function CreatePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { client } = getClientStudio(clientId);
  const drive = driveStatus(clientId);
  return (
    <CreateView
      client={client}
      defaultSlot={nextBestSlot(client)}
      drive={{ connected: drive.connected, folderUrl: drive.folder }}
      agentsRoomKnown={Boolean(findRoomByName(client.rooms.work))}
      ai={aiLabel(clientId)}
    />
  );
}

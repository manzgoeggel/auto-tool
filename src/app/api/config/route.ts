import { NextRequest, NextResponse } from 'next/server';
import { getAllConfigs, createConfig, updateConfig, deleteConfig } from '@/lib/db/queries/configs';

export async function GET() {
  try {
    const configs = await getAllConfigs();
    return NextResponse.json(configs);
  } catch (error) {
    console.error('Failed to fetch configs:', error);
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const config = await createConfig(data);
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error('Failed to create config:', error);
    return NextResponse.json({ error: 'Failed to create config' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, ...data } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const config = await updateConfig(id, data);
    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to update config:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    await deleteConfig(parseInt(id, 10));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete config:', error);
    return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 });
  }
}
